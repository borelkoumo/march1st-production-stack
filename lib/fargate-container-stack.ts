import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as cdk from "@aws-cdk/core";
import * as ecsPatterns from "@aws-cdk/aws-ecs-patterns";
import * as efs from "@aws-cdk/aws-efs";
export class FargateContainerStack extends cdk.Stack {
  vpc: ec2.Vpc;
  alb: ecsPatterns.ApplicationLoadBalancedFargateService;
  fileSys: efs.FileSystem;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // this.vpc = this.buildVPC(this);
    this.alb = this.buildECSCluster(this);
  }
  buildECSCluster(
    stack: cdk.Stack
  ): ecsPatterns.ApplicationLoadBalancedFargateService {
    /**
     * Create ELB
     */
    const loadBalancedEcsService =
      new ecsPatterns.ApplicationLoadBalancedFargateService(stack, "Service", {
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry("strapi/strapi"),
          environment: {
            TEST_ENVIRONMENT_VARIABLE1: "test environment variable 1 value",
            TEST_ENVIRONMENT_VARIABLE2: "test environment variable 2 value",
          },
          containerName: "strapi-container",
          containerPort: 1337,
          enableLogging: true,
        },
        desiredCount: 2,
        listenerPort: 80,
        loadBalancerName: "strapi-lb",
        publicLoadBalancer: true,
        serviceName: "strapi-svc",
        healthCheckGracePeriod: cdk.Duration.minutes(10),
      });
    return loadBalancedEcsService;
  }
  buildVPC(stack: cdk.Stack): ec2.Vpc {
    const vpc = new ec2.Vpc(stack, "VPC", {
      cidr: "12.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public-",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private-",
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
      ],
    });
    return vpc;
  }
}
