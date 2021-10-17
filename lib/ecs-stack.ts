import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import { CONFIG } from "../helpers/Globals";
import * as efs from "@aws-cdk/aws-efs";
import * as secretsmanager from "@aws-cdk/aws-secretsmanager";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
/**
 * IMPORT CLASSES
 */

export interface ECSStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  fileSystem: efs.FileSystem;
  accessPoint: efs.AccessPoint;
}

export class FargateStack extends cdk.Stack {
  public readonly alb: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: cdk.Construct, id: string, props: ECSStackProps) {
    super(scope, id, props);
    const vpc = props.vpc;
    const efs = props.fileSystem;
    const ap = props.accessPoint;

    /**
     * IAM ROLES THAT TASKS WILL USE
     */
    const taskRole = new iam.Role(this, "ecsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "ECSTaskExecutionRolePolicy",
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    /**
     * DB SECRET. This contains all informations for connecting to DB
     */
    const dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "DBSecretImported",
      CONFIG.RDS.DB_SECRET_NAME
    );

    /**
     * STRAPI TASK DEFINITION
     */

    // The details of a task definition run on a Fargate cluster.
    // A task definition is required to run Docker containers in Amazon ECS.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html
    /**
     * A task definition describes what a single copy of a task should look like.
     * A task definition has one or more containers;
     * typically, it has one main container (the default container is the first one that's added to the task definition, and it is marked essential) and optionally some supporting containers which are used to support the main container, doings things like upload logs or metrics to monitoring services.
     * https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#task-definitions
     * */
    const strapiTaskDef = new ecs.FargateTaskDefinition(this, `Strapi-Task`, {
      memoryLimitMiB: 2048, // How much CPU and memory to use with each task or each container within a task
      cpu: 1024,
      // The name of the IAM task execution role that grants the ECS agent permission to call AWS APIs on your behalf.
      // The role will be used to retrieve container images from ECR and create CloudWatch log groups.
      executionRole: taskRole,
      // The name of the IAM role that grants containers in the task permission to call AWS APIs on your behalf.
      taskRole: taskRole,
      family: CONFIG.STRAPI.CONTAINER.FAMILY,
      // Any data volumes that should be used with the containers in the task.
      // Amazon ECS supports Amazon EFS volumes, Docker volumes, Bind mounts and FSx for Windows File Server volumes
      // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_data_volumes.html
      volumes: [
        {
          name: CONFIG.STRAPI.EFS.VOLUME_NAME,
          efsVolumeConfiguration: {
            fileSystemId: efs.fileSystemId,
            transitEncryption: "ENABLED",
            authorizationConfig: {
              accessPointId: ap.accessPointId,
            },
          },
        },
      ],
    });

    strapiTaskDef.addContainer("Strapi-Container", {
      // The name of the container.
      containerName: CONFIG.STRAPI.CONTAINER.NAME,
      // The Docker image to use with each container in your task
      image: ecs.ContainerImage.fromRegistry(
        `${CONFIG.STRAPI.CONTAINER.DOCKER.IMAGE}:${CONFIG.STRAPI.CONTAINER.DOCKER.TAG}`
      ),
      /**
       * Port mappings allow containers to access ports on the host container instance to send or receive traffic.
       * Port mappings are specified as part of the container definition.
       * containerPort : The port number on the container that is bound to the user-specified or automatically assigned host port.
       * hostPort : The port number on the container instance to reserve for your container.
       */
      portMappings: [
        {
          hostPort: CONFIG.STRAPI.CONTAINER.HOST_PORT,
          containerPort: CONFIG.STRAPI.CONTAINER.CONTAINER_PORT,
        },
      ],
      // Time duration (in seconds) to wait before giving up on resolving dependencies for a container.
      startTimeout: cdk.Duration.minutes(30),
      // The working directory in which to run commands inside the container.
      workingDirectory: CONFIG.STRAPI.CONTAINER.WORKING_DIR,
      // The log configuration specification for the container.
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `Logs-${CONFIG.STRAPI.CONTAINER.NAME}-Container`,
      }),
      environment: {
        // clear text, not for sensitive data
        DATABASE_CLIENT: "postgres",
        DATABASE_SSL: "false",
      },
      secrets: {
        DATABASE_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
        DATABASE_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
        DATABASE_NAME: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
        DATABASE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, "username"),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
      },
      // command: [
      //   `/bin/sh -c "echo '*** installing dependencies ***' && npm install && strapi develop"`,
      // ],
    });

    strapiTaskDef.findContainer(CONFIG.STRAPI.CONTAINER.NAME)?.addMountPoints({
      containerPath: CONFIG.STRAPI.CONTAINER.WORKING_DIR, // Par exemple "/srv/app"
      sourceVolume: CONFIG.STRAPI.EFS.VOLUME_NAME,
      readOnly: false,
    });

    /**
     * ECS CLUSTER
     * https://www.npmjs.com/package/cdk-fargate-patterns/v/0.3.52
     */

    // An Amazon ECS cluster is a logical grouping of tasks or services.
    // A cluster may contain a mix of tasks hosted on AWS Fargate, Amazon EC2 instances, or external instances.
    const ecsCluster = new ecs.Cluster(this, `Production-Cluster`, {
      vpc: vpc,
      clusterName: `Production-Cluster`,
      // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html
      containerInsights: true,
      // Whether to enable Fargate Capacity Providers. (default: false)
      enableFargateCapacityProviders: true,
    });

    /**
     * STRAPI SERVICE
     */
    // Our cluster will contain only one service
    // An Amazon ECS service allows you to run and maintain a specified number of instances of a task definition simultaneously in an Amazon ECS cluster.
    const alb = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "Strapi-Service",
      {
        // Determines whether the service will be assigned a public IP address. (optional, default: false)
        assignPublicIp: true,
        // The name of the cluster that hosts the service.
        cluster: ecsCluster,
        taskDefinition: strapiTaskDef,
        // The subnets to associate with the service.
        taskSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        }),
        healthCheckGracePeriod: cdk.Duration.minutes(30),

        // Listener port of the application load balancer that will serve traffic to the service.
        loadBalancerName: CONFIG.STRAPI.SERVICE.ALB_NAME,
        listenerPort: CONFIG.STRAPI.SERVICE.ALB_LISTENER_PORT,
        publicLoadBalancer: true, // Default is false
        serviceName: CONFIG.STRAPI.SERVICE.NAME,
        /**
         * Amazon ECS deployment circuit breaker automatically rolls back unhealthy
         * service deployments without the need for manual intervention.
         */
        // circuitBreaker: { rollback: true },
        desiredCount: CONFIG.STRAPI.SERVICE.DESIRED_TASK_COUNT,
        maxHealthyPercent: 200, // 200 car 100=previous deployment and 100=ongoing deployment
        minHealthyPercent: 50,

        platformVersion: ecs.FargatePlatformVersion.LATEST,
      }
    );

    /**
     * CONFIGURE AUTOSCALLING
     */
    const autoScale = alb.service.autoScaleTaskCount({
      minCapacity: CONFIG.STRAPI.SERVICE.AUTO_SCALING_MIN,
      maxCapacity: CONFIG.STRAPI.SERVICE.AUTO_SCALING_MAX,
    });
    autoScale.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 50,
    });
    autoScale.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 50,
    });

    this.alb = alb;

    // // Allow access to EFS from Fargate ECS
    // efs.connections.allowDefaultPortFrom(alb.loadBalancer.connections);

    new cdk.CfnOutput(this, "ALB DNS", {
      value: alb.loadBalancer.loadBalancerDnsName,
    });
  }
}
