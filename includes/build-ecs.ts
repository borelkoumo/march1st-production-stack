import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as iam from "@aws-cdk/aws-iam";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import { CONFIG } from "../helpers/Globals";
import * as efs from "@aws-cdk/aws-efs";
import * as ecr from "@aws-cdk/aws-ecr";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import { ListenerCondition } from "@aws-cdk/aws-elasticloadbalancingv2";

export function buildECSCluster(
  scope: cdk.Construct,
  vpc: ec2.Vpc,
  efs: { fileSystem: efs.FileSystem; accessPoint: efs.AccessPoint }
): elbv2.ApplicationLoadBalancer {
  /**
   * ECS CLUSTER
   */

  // An Amazon ECS cluster is a logical grouping of tasks or services.
  // A cluster may contain a mix of tasks hosted on AWS Fargate, Amazon EC2 instances, or external instances.
  const ecsCluster = new ecs.Cluster(scope, `Production-Cluster`, {
    vpc: vpc,
    clusterName: `Production-Cluster`,
    /**
     * Use CloudWatch Container Insights to collect, aggregate, and summarize metrics and logs from your containerized applications and microservices.
     * CloudWatch automatically collects metrics for many resources, such as CPU, memory, disk, and network.
     * Container Insights also provides diagnostic information, such as container restart failures, to help you isolate issues and resolve them quickly.
     * Container Insights collects data as performance log events using embedded metric format.
     * If true CloudWatch Container Insights will be enabled for the cluster.
     * https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html
     */
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
    family: `${CONFIG.PROJECT_NAME}-cdk-stack`,
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
            // iam: "ENABLED", // Whether or not to use the Amazon ECS task IAM role defined in a task definition when mounting the Amazon EFS file system. If enabled, transit encryption must be enabled
          },
        },
      },
    ],
  });

  /**
   * STRAPI CONTAINER DEFINITION
   */
  // You can define multiple containers for task definition.
  const strapiContainerDef = new ecs.ContainerDefinition(
    scope,
    "Strapi-Container",
    {
      // The Docker image to use with each container in your task
      image: ecs.ContainerImage.fromEcrRepository(
        ecr.Repository.fromRepositoryName(
          scope,
          "Repository",
          CONFIG.STRAPI.CONTAINER.ECR_IMAGE
        ),
        CONFIG.STRAPI.CONTAINER.ECR_IMAGETAG
      ),
      // image: ecs.ContainerImage.fromRegistry(
      //   "strapi/strapi" // The Docker image to use with each container in your task
      // ),
      // The name of the task definition that includes this container definition.
      taskDefinition: strapiTaskDef,
      // The name of the container.
      containerName: CONFIG.STRAPI.CONTAINER.NAME,
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
        KEY: "value",
      },
      // secrets: {
      //   // Retrieved from AWS Secrets Manager or AWS Systems Manager Parameter Store at container start-up.
      //   SECRET: ecs.Secret.fromSecretsManager(secret),
      //   DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, "password"), // Reference a specific JSON field, (requires platform version 1.4.0 or later for Fargate tasks)
      //   DB_PORT: ecs.Secret.fromSsmParameter(parameter),
      //   DB_USER: ecs.Secret.fromSsmParameter(parameter),
      //   DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"), // Reference a specific JSON field, (requires platform version 1.4.0 or later for Fargate tasks)
      // },
    }
  );
  strapiContainerDef.addMountPoints({
    containerPath: CONFIG.STRAPI.CONTAINER.MOUNT_POINT, // Par exemple "/src/app"
    sourceVolume: CONFIG.STRAPI.EFS.VOLUME_NAME,
    readOnly: false,
  });

  /**
   * STRAPI SERVICE
   */
  const strapiService = new ecs.FargateService(scope, "Strapi-Service", {
    serviceName: CONFIG.STRAPI.SERVICE.NAME,
    cluster: ecsCluster,
    taskDefinition: strapiTaskDef,
    assignPublicIp: true,
    vpcSubnets: vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
    }),
    desiredCount: CONFIG.STRAPI.SERVICE.DESIRED_COUNT,
    healthCheckGracePeriod: cdk.Duration.minutes(5),
    minHealthyPercent: 50,
    maxHealthyPercent: 200,
    platformVersion: ecs.FargatePlatformVersion.LATEST,
  });

  /**
   * APPLICATION LOAD BALANCER
   */
  const alb = new elbv2.ApplicationLoadBalancer(scope, "Production-LB", {
    loadBalancerName: CONFIG.ALB.NAME,
    vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
    vpc,
    internetFacing: true,
  });
  // Add a listener and open up the load balancer's security group
  // to the world.
  const httpListener = alb.addListener("Https-Listener", {
    port: 80,
    open: true,
  });

  // Redirect HTTP to HTTPS
  // lb.addRedirect({
  //   sourceProtocol: elbv2.ApplicationProtocol.HTTP,
  //   targetProtocol: elbv2.ApplicationProtocol.HTTPS,
  // });

  /**
   * ADD STRAPI TO ALB PATH /strapi/*
   */

  // Add Strapi containers as targets in target group
  const strapiTG = httpListener.addTargets("strapi-tg", {
    targetGroupName: CONFIG.STRAPI.SERVICE.TARGET_GROUP_NAME,
    protocol: elbv2.ApplicationProtocol.HTTP,
    port: CONFIG.STRAPI.CONTAINER.HOST_PORT,
    targets: [strapiService],
    conditions: [
      // Path here is /strapi/*
      ListenerCondition.pathPatterns([CONFIG.STRAPI.SERVICE.ALB_PATH]),
    ],
    priority: 1,
    healthCheck: {
      enabled: true,
      interval: cdk.Duration.seconds(30),
      path: "/",
      port: "traffic-port",
      protocol: elbv2.Protocol.HTTP,
      unhealthyThresholdCount: 5,
      healthyThresholdCount: 2,
    },
  });

  // Our cluster will contain only one service
  // An Amazon ECS service allows you to run and maintain a specified number of instances of a task definition simultaneously in an Amazon ECS cluster.
  // const alb = new ecs_patterns.ApplicationLoadBalancedFargateService(
  //   scope,
  //   "Production-Service",
  //   {
  //     // Determines whether the service will be assigned a public IP address. (optional, default: false)
  //     assignPublicIp: true,
  //     // The name of the cluster that hosts the service.
  //     cluster: ecsCluster,
  //     taskDefinition: strapiTaskDef,
  //     // The subnets to associate with the service.
  //     taskSubnets: vpc.selectSubnets({
  //       subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
  //     }),
  //     desiredCount: CONFIG.ALB.DESIRED_TASK_COUNT,
  //     healthCheckGracePeriod: cdk.Duration.minutes(10),
  //     // Listener port of the application load balancer that will serve traffic to the service.
  //     loadBalancerName: CONFIG.ALB.NAME,
  //     listenerPort: CONFIG.ALB.LISTENER_PORT,
  //     publicLoadBalancer: true, // Default is false
  //     serviceName: CONFIG.ALB.SERVICE_NAME,
  //     /**
  //      * Amazon ECS deployment circuit breaker automatically rolls back unhealthy
  //      * service deployments without the need for manual intervention.
  //      */
  //     circuitBreaker: { rollback: true },
  //     maxHealthyPercent: 100,
  //     minHealthyPercent: 0,
  //     platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
  //   }
  // );

  // const listener2 = alb.loadBalancer.addListener("Strapi-Listener", {
  //   port: 80,
  // });
  // alb.targetGroup.registerLoadBalancerTargets({
  //   containerName: "web",
  //   containerPort: 80,
  //   newTargetGroupId: "ECS",
  //   listener: ecs.ListenerConfig.applicationListener(listener, {
  //     protocol: elbv2.ApplicationProtocol.HTTPS,
  //   }),
  // });
  // listener.addTargets("Strapi-Targets", {
  //   priority: 1,
  //   conditions: [
  //     elbv2.ListenerCondition.pathPatterns([CONFIG.STRAPI.SERVICE.ALB_PATH]),
  //   ],
  //   port: 8080,
  //   targets: [strapiTaskDef],
  // });

  // alb.targetGroup.configureHealthCheck({
  //   path: "/",
  //   port: CONFIG.STRAPI.CONTAINER.HOST_PORT.toString(),
  // });
  // /**
  //  * Add STRAPI as target
  //  */
  // // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-elasticloadbalancingv2-readme.html#using-application-load-balancer-targets
  // const nlb = new elbv2.NetworkLoadBalancer(this, "Nlb", {
  //   vpc,
  //   crossZoneEnabled: true,
  //   internetFacing: true,
  // });

  // const listener = nlb.addListener("listener", { port: 80 });

  // listener.addTargets("Targets", {
  //   targets: [new targets.AlbTarget(svc.loadBalancer, 80)],
  //   port: 80,
  // });

  // const listener = nlb.addListener("listener", { port: 80 });
  // listener.addTargets("Example.Com Fleet", {
  //   priority: 10,
  //   conditions: [
  //     ListenerCondition.hostHeaders(["example.com"]),
  //     ListenerCondition.pathPatterns(["/ok", "/path"]),
  //   ],
  //   port: 8080,
  //   targets: [asg],
  // });

  // Allow access to EFS from Fargate ECS
  efs.fileSystem.connections.allowDefaultPortFrom(strapiService.connections);

  new cdk.CfnOutput(scope, "ALB DNS", {
    value: alb.loadBalancerDnsName,
  });

  return alb;
}
