import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as kms from "@aws-cdk/aws-kms";
import * as rds from "@aws-cdk/aws-rds";
/**
 * IMPORT CLASSES
 */
import { CONFIG } from "../helpers/Globals";

export interface RDSStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class RDSStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: cdk.Construct, id: string, props: RDSStackProps) {
    super(scope, id, props);

    // Create VPC
    const vpc = props.vpc;

    // Encryption key for DB
    const dbEncryptionKey = new kms.Key(this, "DBEncryptionKey");
    const username = CONFIG.RDS.DB_USER;
    const dbInstance = new rds.DatabaseInstance(this, "PostgreSQLInstance", {
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
        secretName: CONFIG.RDS.DB_SECRET_NAME,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      },
      databaseName: CONFIG.RDS.DB_NAME,
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

    // Set property
    this.dbInstance = dbInstance;

    // /**
    //  * CREATE Read replica
    //  */
    // const dbReadReplica = new rds.DatabaseInstanceReadReplica(
    //   this,
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
    new cdk.CfnOutput(this, "DB Hostname", {
      value: dbInstance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, "DB Port", {
      value: dbInstance.dbInstanceEndpointPort,
    });
    new cdk.CfnOutput(this, "DB User", {
      value: username,
    });
    new cdk.CfnOutput(this, "DB Engine Family + Version", {
      value: `${dbInstance.engine?.engineFamily} - ${dbInstance.engine?.engineVersion?.fullVersion}`,
    });
  }
}
