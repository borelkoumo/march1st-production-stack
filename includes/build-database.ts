import * as ec2 from "@aws-cdk/aws-ec2";
import * as cdk from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";
import * as kms from "@aws-cdk/aws-kms";

export function buildDatabase(
  scope: cdk.Construct,
  vpc: ec2.Vpc
): rds.DatabaseInstance {
  // Encryption key for DB
  const dbEncryptionKey = new kms.Key(scope, "DBEncryptionKey");
  const username = "admin";
  const dbInstance = new rds.DatabaseInstance(scope, "PostgreSQLInstance", {
    engine: rds.DatabaseInstanceEngine.postgres({
      version: rds.PostgresEngineVersion.VER_10_17,
    }),
    // optional, defaults to m5.large
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.BURSTABLE3,
      ec2.InstanceSize.SMALL
    ),
    // By default, the master password will be generated and stored in AWS Secrets Manager.
    // Creates an admin user of postgres with a generated password,
    credentials: rds.Credentials.fromGeneratedSecret(username, {
      secretName: "POSTGRE_SQL_DB_PASSWORD",
    }),
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
    },
    // The allocated storage size, specified in gigabytes (GB).
    // optional, default: 100
    allocatedStorage: 10,
    // To use the storage auto scaling option of RDS you can specify the maximum allocated storage.
    // This is the upper limit to which RDS can automatically scale the storage.
    maxAllocatedStorage: 100,
    // Specifies if the database instance is a multiple Availability Zone deployment.
    multiAz: true,
    // If you specify true, it creates an instance with a publicly resolvable DNS name, which resolves to a public IP address.
    // If you specify false, it creates an internal instance with a DNS name that resolves to a private IP address.
    publiclyAccessible: true,
    copyTagsToSnapshot: true, // whether to save the cluster tags when creating the snapshot. Default is 'true'
    cloudwatchLogsExports: ["postgresql"], // Export the PostgreSQL logs
    // default: RemovalPolicy.SNAPSHOT (remove the resource, but retain a snapshot of the data))
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    // Encryption
    storageEncrypted: true,
    storageEncryptionKey: dbEncryptionKey,
  });

  // /**
  //  * CREATE Read replica
  //  */
  // const dbReadReplica = new rds.DatabaseInstanceReadReplica(
  //   scope,
  //   "PostgreSQLReadReplica",
  //   {
  //     sourceDatabaseInstance: dbInstance,
  //     instanceType: ec2.InstanceType.of(
  //       ec2.InstanceClass.BURSTABLE3,
  //       ec2.InstanceSize.SMALL
  //     ),
  //     vpc,
  //   }
  // );
  new cdk.CfnOutput(scope, "DB Hostname", {
    value: dbInstance.instanceEndpoint.hostname,
  });
  new cdk.CfnOutput(scope, "DB Port", {
    value: `${dbInstance.instanceEndpoint.port}`,
  });
  new cdk.CfnOutput(scope, "DB Engine Family and Version", {
    value: `${dbInstance.engine?.engineFamily} - ${dbInstance.engine?.engineVersion}`,
  });
  new cdk.CfnOutput(scope, "DB User", {
    value: `${username} (password in SSM)`,
  });
  return dbInstance;
}
