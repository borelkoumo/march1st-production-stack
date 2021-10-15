import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as efs from "@aws-cdk/aws-efs";
import * as rds from "@aws-cdk/aws-rds";
import * as elbv2 from "@aws-cdk/aws-elasticloadbalancingv2";
import * as secretsmanager from "@aws-cdk/aws-secretsmanager";
/**
 * IMPORT CLASSES
 */
import { buildVPC } from "../includes/build-vpc";
import { buildBastionHost } from "../includes/bastion-host";
import { buildEFS } from "../includes/build-efs";
import { buildECSCluster } from "../includes/build-ecs";
import { buildDatabase } from "../includes/build-database";

export class March1StProducerVpcStack extends cdk.Stack {
  vpc: ec2.Vpc;
  ec2BastionHost: ec2.Instance;
  efsFileSystem: { fileSystem: efs.FileSystem; accessPoint: efs.AccessPoint };
  ecsCluster: elbv2.ApplicationLoadBalancer;
  databaseInstance: rds.DatabaseInstance;
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.vpc = buildVPC(this);
    //this.ec2BastionHost = buildBastionHost(this, this.vpc);
    this.efsFileSystem = buildEFS(this, this.vpc);
    this.databaseInstance = buildDatabase(this, this.vpc);
    this.ecsCluster = buildECSCluster(this, this.vpc, this.efsFileSystem);
  }
}
