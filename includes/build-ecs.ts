import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import { CONFIG } from "../helpers/Globals";
import * as efs from "@aws-cdk/aws-efs";
import * as ecr from "@aws-cdk/aws-ecr";
import * as secretsmanager from "@aws-cdk/aws-secretsmanager";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
export function buildECSCluster(
  scope: cdk.Construct,
  vpc: ec2.Vpc,
  efs: { fileSystem: efs.FileSystem; accessPoint: efs.AccessPoint }
): ecs_patterns.ApplicationLoadBalancedFargateService {
  /**
   * ECS CLUSTER
   */

  /**
   * TO DO : read https://www.npmjs.com/package/cdk-fargate-patterns/v/0.3.52
   */

  // An Amazon ECS cluster is a logical grouping of tasks or services.
  // A cluster may contain a mix of tasks hosted on AWS Fargate, Amazon EC2 instances, or external instances.
  const ecsCluster = new ecs.Cluster(scope, `Production-Cluster`, {
    vpc: vpc,
    clusterName: `Production-Cluster`,
    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html
    containerInsights: true,
    // Whether to enable Fargate Capacity Providers. (default: false)
    enableFargateCapacityProviders: true,
  });

  /**
   * IAM ROLES THAT TASKS WILL USE
   */
  const taskRole = new iam.Role(scope, "ecsTaskExecutionRole", {
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
  });
  taskRole.addManagedPolicy(
    iam.ManagedPolicy.fromManagedPolicyArn(
      scope,
      "ECSTaskExecutionRolePolicy",
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    )
  );

  /**
   * DB Secret. This contains all informations for connecting to DB
   */
  const dbSecret = secretsmanager.Secret.fromSecretNameV2(
    scope,
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
  const strapiTaskDef = new ecs.FargateTaskDefinition(scope, `Strapi-Task`, {
    memoryLimitMiB: 2048, // How much CPU and memory to use with each task or each container within a task
    cpu: 512,
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
          fileSystemId: efs.fileSystem.fileSystemId,
          transitEncryption: "ENABLED",
          authorizationConfig: {
            accessPointId: efs.accessPoint.accessPointId,
          },
        },
      },
    ],
  });

  strapiTaskDef.addContainer("Strapi-Container", {
    // The name of the container.
    containerName: CONFIG.STRAPI.CONTAINER.NAME,
    // The Docker image to use with each container in your task
    image: ecs.ContainerImage.fromEcrRepository(
      ecr.Repository.fromRepositoryName(
        scope,
        "Repository",
        CONFIG.STRAPI.CONTAINER.ECR_IMAGE
      ),
      CONFIG.STRAPI.CONTAINER.ECR_IMAGETAG
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
    startTimeout: cdk.Duration.minutes(5),
    // The working directory in which to run commands inside the container.
    workingDirectory: CONFIG.STRAPI.CONTAINER.MOUNT_POINT,
    // The log configuration specification for the container.
    logging: ecs.LogDrivers.awsLogs({
      streamPrefix: `Logs-${CONFIG.STRAPI.CONTAINER.NAME}-Container`,
    }),
    environment: {
      // clear text, not for sensitive data
      DATABASE_NAME: CONFIG.RDS.DB_NAME,
      DATABASE_SSL: "false",
    },
    secrets: {
      DATABASE_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
      DATABASE_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
      DATABASE_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, "username"),
      DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
    },
  });

  strapiTaskDef.findContainer(CONFIG.STRAPI.CONTAINER.NAME)?.addMountPoints({
    containerPath: CONFIG.STRAPI.CONTAINER.MOUNT_POINT, // Par exemple "/src/app"
    sourceVolume: CONFIG.STRAPI.EFS.VOLUME_NAME,
    readOnly: false,
  });

  /**
   * STRAPI SERVICE
   */
  // Our cluster will contain only one service
  // An Amazon ECS service allows you to run and maintain a specified number of instances of a task definition simultaneously in an Amazon ECS cluster.
  const alb = new ecs_patterns.ApplicationLoadBalancedFargateService(
    scope,
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
      desiredCount: CONFIG.STRAPI.SERVICE.DESIRED_COUNT,
      healthCheckGracePeriod: cdk.Duration.minutes(5),
      // Listener port of the application load balancer that will serve traffic to the service.
      loadBalancerName: CONFIG.STRAPI.SERVICE.ALB_NAME,
      listenerPort: CONFIG.STRAPI.SERVICE.ALB_LISTENER_PORT,
      publicLoadBalancer: true, // Default is false
      serviceName: CONFIG.STRAPI.SERVICE.NAME,
      /**
       * Amazon ECS deployment circuit breaker automatically rolls back unhealthy
       * service deployments without the need for manual intervention.
       */
      circuitBreaker: { rollback: true },
      maxHealthyPercent: 100,
      minHealthyPercent: 50,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
    }
  );
  // const strapiService = new ecs.FargateService(scope, "Strapi-Service", {
  //   serviceName: CONFIG.STRAPI.SERVICE.NAME,
  //   cluster: ecsCluster,
  //   taskDefinition: strapiTaskDef,
  //   // Determines whether the service will be assigned a public IP address. (optional, default: false)
  //   assignPublicIp: true,
  //   vpcSubnets: vpc.selectSubnets({
  //     subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
  //   }),
  // });

  /**
   * APPLICATION LOAD BALANCER
   */
  // const alb = new elbv2.ApplicationLoadBalancer(scope, "Production-LB", {
  //   loadBalancerName: CONFIG.ALB.NAME,
  //   vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
  //   vpc,
  //   internetFacing: true,
  // });
  // // Add a listener and open up the load balancer's security group
  // // to the world.
  // const httpListener = alb.addListener("Https-Listener", {
  //   port: 80,
  //   open: true,
  //   defaultAction: elbv2.ListenerAction.fixedResponse(200, {
  //     contentType: "application/json",
  //     messageBody: "Welcome to our March1st production load balancer",
  //   }),
  // });

  // /**
  //  * ADD STRAPI TO ALB PATH /strapi/*
  //  */
  // // Add Strapi containers as targets in target group
  // httpListener.addTargets("strapi-tg", {
  //   targetGroupName: CONFIG.STRAPI.SERVICE.TARGET_GROUP_NAME,
  //   protocol: elbv2.ApplicationProtocol.HTTP,
  //   port: CONFIG.STRAPI.CONTAINER.HOST_PORT,
  //   targets: [strapiService],
  //   conditions: [
  //     // Path here is /strapi/*
  //     elbv2.ListenerCondition.pathPatterns([CONFIG.STRAPI.SERVICE.ALB_PATH]),
  //   ],
  //   priority: 1,
  //   healthCheck: {
  //     enabled: true,
  //     interval: cdk.Duration.seconds(30),
  //     path: "/",
  //     port: "traffic-port",
  //     protocol: elbv2.Protocol.HTTP,
  //     unhealthyThresholdCount: 5,
  //     healthyThresholdCount: 2,
  //   },
  // });

  // Allow access to EFS from Fargate ECS
  efs.fileSystem.connections.allowDefaultPortFrom(alb.loadBalancer.connections);

  new cdk.CfnOutput(scope, "ALB DNS", {
    value: alb.loadBalancer.loadBalancerDnsName,
  });

  return alb;
}
