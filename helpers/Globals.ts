// For Strapi
const CONFIG = {
  PROJECT_NAME: "march1st-prod",
  VPC: { CIDR: "11.0.0.0/16" },
  /**
   * STRAPI CONFIG
   */
  STRAPI: {
    EFS: {
      ACCESS_POINT: "/strapi",
      VOLUME_NAME: "strapi-volume",
    },
    CONTAINER: {
      NAME: "strapi-container",
      FAMILY: "strapi",
      ECR_IMAGE: "strapi-with-efs",
      ECR_IMAGETAG: "v4",
      MOUNT_POINT: "/src/app",
      HOST_PORT: 1337,
      CONTAINER_PORT: 1337,
    },
    SERVICE: {
      NAME: "strapi-svc",
      TARGET_GROUP_NAME: "strapi-tg",
      ALB_PATH: "/strapi*",
      DESIRED_COUNT: 2,
    },
  },
  /**
   * CAMUNDA CONFIG
   */
  CAMUNDA: {
    EFS: {
      ACCESS_POINT: "/camunda",
      VOLUME_NAME: "camunda-volume",
    },
    CONTAINER: {
      NAME: "strapi-container",
      ECR_IMAGE: "strapi-with-efs",
      ECR_IMAGETAG: "v4",
      MOUNT_POINT: "/src/app",
      HOST_PORT: 1337,
      CONTAINER_PORT: 1337,
    },
    ALB_PATH: "/camunda/*",
  },
  /**
   * ALB CONFIG
   */
  ALB: {
    NAME: "production-alb",
    SERVICE_NAME: "Strapi-Service",
    LISTENER_PORT: 80,
    DESIRED_TASK_COUNT: 1,
  },
  RDS: {
    // Define the name given to a database that Amazon RDS creates when it creates the DB instance
    DATABASE_NAME: "strapi",
    // The master user of the DB
    USERNAME: "postgres",
    // the master password will be generated and stored in AWS Secrets Manager.
    /**
     * {
        "password": "tHRoAJ=pQ47BKvprOm2fs-.gjX3u,D",
        "engine": "postgres",
        "port": 5432,
        "dbInstanceIdentifier": "pp1svthanp2mg9y",
        "host": "pp1svthanp2mg9y.cmkrccc0ichf.me-south-1.rds.amazonaws.com",
        "username": "postgres"
      }
     */
    SECRET_NAME: "POSTGRESQL_SECRET",
  },
};
Object.freeze(CONFIG);
export { CONFIG };
