import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as efs from "@aws-cdk/aws-efs";

/**
 * IMPORT CLASSES
 */
import { CONFIG } from "../helpers/Globals";

export interface EFSStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class EFSStack extends cdk.Stack {
  public readonly fileSystem: efs.FileSystem;
  public readonly accessPoint: efs.AccessPoint;

  constructor(scope: cdk.Construct, id: string, props: EFSStackProps) {
    super(scope, id, props);

    // Get VPC
    const vpc = props.vpc;

    // Create security group for EFS
    const efsSecurityGroup = new ec2.SecurityGroup(this, "EFS-SG", {
      vpc: vpc,
      allowAllOutbound: true,
      description: "Security group for EFS",
      securityGroupName: "EFS-SG",
    });

    // Create EFS in private subnets
    const efsFileSystem = new efs.FileSystem(this, `EFS-AMLC`, {
      vpc: vpc,
      securityGroup: efsSecurityGroup,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      }),
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_90_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Modify security group
    efsFileSystem.connections.allowDefaultPortFromAnyIpv4();

    // Add Access Point
    const efsAccessPoint = efsFileSystem.addAccessPoint(`AccessPoint`, {
      path: CONFIG.STRAPI.EFS.ACCESS_POINT, // In this case, the value is /strapi
      posixUser: {
        uid: "1000",
        gid: "1000",
      },
      createAcl: {
        ownerGid: "1000",
        ownerUid: "1000",
        permissions: "755",
      },
    });

    // Set properties
    this.fileSystem = efsFileSystem;
    this.accessPoint = efsAccessPoint;

    new cdk.CfnOutput(this, "EFS ID", {
      value: efsFileSystem.fileSystemId,
    });
    new cdk.CfnOutput(this, "Access Point ID", {
      value: efsAccessPoint.accessPointId,
    });
    new cdk.CfnOutput(this, "Access Point PATH", {
      value: CONFIG.STRAPI.EFS.ACCESS_POINT,
    });
  }
}
