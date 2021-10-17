#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { VPCStack } from "../lib/vpc-stack";
import { EFSStack } from "../lib/efs-stack";
import { RDSStack } from "../lib/rds-stack";
import { FargateStack } from "../lib/ecs-stack";
import { SecurityGroupStack } from "../lib/security-group-stack";
import { EC2Stack } from "../lib/ec2-stack";

const app = new cdk.App();
const env = {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: "917875368816", region: "us-east-1" },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
};

const vpcStack = new VPCStack(app, "VPCStack", {
  stackName: "VPCStack",
  env: env,
});
const ec2Stack = new EC2Stack(app, "EC2Stack", {
  stackName: "EC2Stack",
  env: env,
  vpc: vpcStack.vpc,
});
const efsStack = new EFSStack(app, "EFSStack", {
  stackName: "EFSStack",
  env: env,
  vpc: vpcStack.vpc,
});
const rdsStack = new RDSStack(app, "RDSStack", {
  stackName: "RDSStack",
  env: env,
  vpc: vpcStack.vpc,
});
const fargateStack = new FargateStack(app, "FargateStack", {
  stackName: "FargateStack",
  env: env,
  vpc: vpcStack.vpc,
  fileSystem: efsStack.fileSystem,
  accessPoint: efsStack.accessPoint,
});

const secGroupStack = new SecurityGroupStack(app, "SecurityGroupStack", {
  stackName: "SecurityGroupStack",
  env: env,
  fileSystem: efsStack.fileSystem,
  dbInstance: rdsStack.dbInstance,
  alb: fargateStack.alb,
});
