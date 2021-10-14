import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";
import * as path from "path";
import { KeyPair } from "cdk-ec2-key-pair";
import { Asset } from "@aws-cdk/aws-s3-assets";

export function buildBastionHost(
  scope: cdk.Construct,
  vpc: ec2.Vpc
): ec2.Instance {
  // Create a key pair to be used with this ec2 instance
  // If lost, use this link : https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/replacing-lost-key-pair.html
  const keyPair = new KeyPair(scope, `KeyPair`, {
    name: `keypair-for-ec2-bastion`,
    description: "Created with CDK Deployment for bastion host instances",
  });

  // Create IAM Role for Bastion Host
  const role = new iam.Role(scope, `ec2RoleForBastionHost`, {
    assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
  });
  role.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
  );

  // Create security group for BastionHost
  const securityGroupBastionHost = new ec2.SecurityGroup(
    scope,
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

  // Use Latest Amazon Linux Image - CPU Type ARM64
  const ami = new ec2.AmazonLinuxImage({
    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    cpuType: ec2.AmazonLinuxCpuType.X86_64,
  });

  // Create the instance using the Security Group, AMI, and KeyPair defined in the VPC created
  const publicVpcSubnets = vpc.selectSubnets({
    subnetType: ec2.SubnetType.PUBLIC,
  });

  new ec2.InstanceType("t3.small");
  const bastionHost = new ec2.Instance(scope, `Instance-Bastion`, {
    vpc: vpc,
    vpcSubnets: publicVpcSubnets,
    instanceType: new ec2.InstanceType("t3.small"),
    machineImage: ami,
    securityGroup: securityGroupBastionHost,
    keyName: keyPair.keyPairName,
    role: role,
  });

  // Elastic IP
  const eip = new ec2.CfnEIP(scope, `EIP-Bastion`);
  // Associate EIP to EC2 Instance
  let ec2Assoc = new ec2.CfnEIPAssociation(scope, `EIP-For-EC2-Bastion`, {
    eip: eip.ref,
    instanceId: bastionHost.instanceId,
  });

  // UserData
  // Create an asset that will be used as part of User Data to run on first load
  const asset = new Asset(scope, "Asset", {
    path: path.join(__dirname, "../userdata/userdata.sh"),
  });
  const localPath = bastionHost.userData.addS3DownloadCommand({
    bucket: asset.bucket,
    bucketKey: asset.s3ObjectKey,
  });
  bastionHost.userData.addExecuteFileCommand({
    filePath: localPath,
    arguments: "--verbose -y",
  });
  asset.grantRead(bastionHost.role);

  const host = new ec2.BastionHostLinux(scope, "BastionHost", {
    vpc,
    subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
  });
  host.allowSshAccessFrom(ec2.Peer.anyIpv4());

  // Create outputs for connecting
  new cdk.CfnOutput(scope, "EC2 Public IP", {
    value: bastionHost.instancePublicIp,
  });
  new cdk.CfnOutput(scope, "EC2 Elastic IP", {
    value: eip.ref,
  });
  new cdk.CfnOutput(scope, "EIP Association", {
    value: ec2Assoc.ref,
  });
  new cdk.CfnOutput(scope, "Download Key Command", {
    value: `aws secretsmanager get-secret-value --secret-id ec2-ssh-key/${keyPair.keyPairName}/private --query SecretString --output text > ${keyPair.keyPairName}.pem && chmod 400 ${keyPair.keyPairName}.pem`,
  });
  new cdk.CfnOutput(scope, "SSH Command", {
    value: `ssh -i ${keyPair.keyPairName}.pem -o IdentitiesOnly=yes ec2-user@${bastionHost.instancePublicIp}`,
  });
  new cdk.CfnOutput(scope, "EC2 User data", {
    value: bastionHost.userData.render(),
  });

  return bastionHost;
}

export function buildSimpleBastionHost(
  scope: cdk.Construct,
  vpc: ec2.Vpc
): ec2.BastionHostLinux {
  const bastionHostLinux = new ec2.BastionHostLinux(scope, "BastionHost", {
    vpc,
    subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
  });
  bastionHostLinux.allowSshAccessFrom(ec2.Peer.anyIpv4());
  return bastionHostLinux;
}
