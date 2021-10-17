import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";

/**
 * IMPORT CLASSES
 */
import { CONFIG } from "../helpers/Globals";
import { CfnOutput } from "@aws-cdk/core";

export class VPCStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = new ec2.Vpc(this, `VPC`, {
      cidr: CONFIG.VPC.CIDR,
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

    // Set properties
    this.vpc = vpc;

    // Output
    new CfnOutput(this, "VPC CIDR", {
      value: vpc.vpcCidrBlock,
    });

    for (let i = 1; i <= vpc.availabilityZones.length; i++) {
      new CfnOutput(this, `AZ ${i}`, {
        value: vpc.availabilityZones[i - 1],
      });
    }

    for (let i = 1; i <= vpc.publicSubnets.length; i++) {
      let sn = vpc.publicSubnets[i - 1];
      new CfnOutput(this, `Public Subnet ${i}`, {
        value: `${sn.subnetId} (${sn.ipv4CidrBlock})`,
      });
    }

    for (let i = 1; i <= vpc.privateSubnets.length; i++) {
      let sn = vpc.privateSubnets[i - 1];
      new CfnOutput(this, `Private Subnet ${i}`, {
        value: `${sn.subnetId} (${sn.ipv4CidrBlock})`,
      });
    }
  }
}
