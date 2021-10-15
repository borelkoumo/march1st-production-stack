import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import { CONFIG } from "../helpers/Globals";

export function buildVPC(scope: cdk.Construct): ec2.Vpc {
  // Create VPC
  const vpc = new ec2.Vpc(scope, `VPC`, {
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

  return vpc;
}
