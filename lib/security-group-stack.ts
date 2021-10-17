import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as efs from "@aws-cdk/aws-efs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as rds from "@aws-cdk/aws-rds";
/**
 * IMPORT CLASSES
 */

export interface SecurityGroupStackProps extends cdk.StackProps {
  fileSystem: efs.FileSystem;
  dbInstance: rds.DatabaseInstance;
  alb: ecs_patterns.ApplicationLoadBalancedFargateService;
}

export class SecurityGroupStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: SecurityGroupStackProps
  ) {
    super(scope, id, props);
    const efs = props.fileSystem;
    const alb = props.alb;
    const dbInstance = props.dbInstance;

    // // Allow access to EFS from ECS
    // efs.connections.allowDefaultPortFrom(alb.loadBalancer.connections);
    // const sg = alb.loadBalancer.connections.securityGroups;
    // for (let i = 0; i < sg.length; i++) {
    //   let s: ec2.ISecurityGroup = sg[i];
    //   s.securityGroupId
    // }
    // efs.connections.allowDefaultPortFrom(alb.loadBalancer.connections);

    // // Allow Access to RDS from ECS
    // dbInstance.connections.allowDefaultPortFrom(alb.loadBalancer.connections);

    efs.connections.allowDefaultPortFromAnyIpv4();
    dbInstance.connections.allowDefaultPortFromAnyIpv4();
  }
}
