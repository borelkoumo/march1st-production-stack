import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import { CONFIG } from "../helpers/Globals";
import * as efs from "@aws-cdk/aws-efs";
import * as s3 from "@aws-cdk/aws-s3";
import {
  GithubSyncSource,
  S3ArchiveSyncSource,
  SyncedAccessPoint,
} from "cdk-efs-assets";
export function buildEFS(
  scope: cdk.Construct,
  vpc: ec2.Vpc
): { fileSystem: efs.FileSystem; accessPoint: efs.AccessPoint } {
  // Create security group for EFS
  const efsSecurityGroup = new ec2.SecurityGroup(scope, "EFS-SG", {
    vpc: vpc,
    allowAllOutbound: true,
    description: "Security group for EFS",
    securityGroupName: "EFS-SG",
  });

  // Create EFS in private subnets
  const efsFileSystem = new efs.FileSystem(scope, `EFS-AMLC`, {
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

  // /**
  //  * Populate fs
  //  */
  // const bucket = s3.Bucket.fromBucketName(
  //   scope,
  //   "Bucket",
  //   "march1st-production-bucket"
  // );

  // const efsAccessPoint = new SyncedAccessPoint(scope, "StrapiAccessPoint", {
  //   vpc: vpc,
  //   fileSystem: efsFileSystem,
    // path: CONFIG.STRAPI.EFS.ACCESS_POINT,
  //   posixUser: {
  //     uid: "1000",
  //     gid: "1000",
  //   },
  //   createAcl: {
  //     ownerGid: "1000",
  //     ownerUid: "1000",
  //     permissions: "755",
  //   },
  //   syncSource: new GithubSyncSource({
  //     vpc,
  //     repository: "https://github.com/username/repo.git",
  //     secret: {
  //       id: "github",
  //       key: "oauth_token",
  //     },
  //   }),
  // });

  new cdk.CfnOutput(scope, "EFS ID", {
    value: efsFileSystem.fileSystemId,
  });
  new cdk.CfnOutput(scope, "Access Point ID", {
    value: efsAccessPoint.accessPointId,
  });
  new cdk.CfnOutput(scope, "Access Point PATH", {
    value: CONFIG.STRAPI.EFS.ACCESS_POINT,
  });

  return { fileSystem: efsFileSystem, accessPoint: efsAccessPoint };
}
