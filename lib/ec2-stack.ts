import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";
import * as path from "path";
/**
 * IMPORT CLASSES
 */
import { KeyPair } from "cdk-ec2-key-pair";
import { Asset } from "@aws-cdk/aws-s3-assets";
import { readFileSync } from "fs";
import { CONFIG } from "../helpers/Globals";

export interface EC2StackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class EC2Stack extends cdk.Stack {
  public readonly ec2BastionHost: ec2.Instance;
  constructor(scope: cdk.Construct, id: string, props: EC2StackProps) {
    super(scope, id, props);

    const vpc = props.vpc;
    // Create a key pair to be used with this ec2 instance
    // If lost, use this link : https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/replacing-lost-key-pair.html
    // const keyPair = new KeyPair(this, `KeyPair`, {
    //   name: `keypair-for-ec2-bastion`,
    //   description: "Created with CDK Deployment for bastion host instances",
    // });

    // Create IAM Role for Bastion Host
    const role = new iam.Role(this, `ec2RoleForBastionHost`, {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    // Create security group for BastionHost
    const securityGroupBastionHost = new ec2.SecurityGroup(
      this,
      "SG-BastionHost",
      {
        vpc: vpc,
        allowAllOutbound: true,
        description: "Allow SSH and HTTP from 0.0.0.0/32",
        securityGroupName: "SG-BastionHost",
      }
    );
    securityGroupBastionHost.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH Access"
    );
    securityGroupBastionHost.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP Access"
    );

    // Create the instance using the Security Group, AMI, and KeyPair defined in the VPC created

    const ec2Instance = new ec2.Instance(this, `Instance-Bastion`, {
      vpc: vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      instanceType: new ec2.InstanceType("t3.small"),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      securityGroup: securityGroupBastionHost,
      keyName: CONFIG.EC2.KEY_PAIR_NAME,
      // keyName: keyPair.keyPairName,
      role: role,
      instanceName: "EC2 Bastion",
    });

    // Elastic IP
    // const eip = new ec2.CfnEIP(this, `EIP-Bastion`);
    // // Associate EIP to EC2 Instance
    // let ec2Assoc = new ec2.CfnEIPAssociation(this, `EIP-For-EC2-Bastion`, {
    //   eip: eip.ref,
    //   instanceId: bastionHost.instanceId,
    // });

    // UserData
    // const co = [
    //   // "#!/bin/bash",
    //   "sudo yum update -y",
    //   "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash",
    //   ". ~/.nvm/nvm.sh",
    //   "nvm install 14.17.6",
    //   "sudo amazon-linux-extras install docker -y",
    //   "sudo yum install git -y",
    //   "sudo yum install nfs-utils -y",
    //   "sudo yum install amazon-efs-utils -y",
    //   "npm install pm2@latest -g",
    //   "sudo yum install nginx -y",
    //   "sudo systemctl enable nginx.service",
    //   "sudo systemctl start nginx",
    // ];
    // ec2Instance.userData.addCommands(...co);

    // 👇 load contents of script
    const userDataScript = readFileSync(
      path.join(__dirname, "../userdata/userdata.sh"),
      "utf8"
    );
    // 👇 add the User Data script to the Instance
    ec2Instance.addUserData(userDataScript);

    // Create an asset that will be used as part of User Data to run on first load
    // const asset = new Asset(this, "Asset", {
    //   path: path.join(__dirname, "../userdata/userdata.sh"),
    // });
    // const localPath = bastionHost.userData.addS3DownloadCommand({
    //   bucket: asset.bucket,
    //   bucketKey: asset.s3ObjectKey,
    // });
    // bastionHost.userData.addExecuteFileCommand({
    //   filePath: localPath,
    //   arguments: "--verbose -y",
    // });
    // asset.grantRead(bastionHost.role);

    // Set property
    this.ec2BastionHost = this.ec2BastionHost;

    // Create outputs for connecting
    new cdk.CfnOutput(this, "EC2 Public IP", {
      value: ec2Instance.instancePublicIp,
    });
    new cdk.CfnOutput(this, "Key pair name", {
      value: CONFIG.EC2.KEY_PAIR_NAME,
    });
    // new cdk.CfnOutput(this, "EC2 User data", {
    //   value: ec2Instance.userData.render(),
    // });
    // new cdk.CfnOutput(this, "Download Key Command", {
    //   value: `aws secretsmanager get-secret-value --secret-id ec2-ssh-key/${keyPair.keyPairName}/private --query SecretString --output text > ${keyPair.keyPairName}.pem && chmod 400 ${keyPair.keyPairName}.pem`,
    // });
    new cdk.CfnOutput(this, "Connection string", {
      value: `ssh -i ${CONFIG.EC2.KEY_PAIR_NAME}.pem ec2-user@${ec2Instance.instancePublicIp}`,
    });
  }
}
