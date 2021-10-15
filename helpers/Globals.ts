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
      ALB_NAME: "strapi-alb",
      DESIRED_COUNT: 2,
      ALB_LISTENER_PORT: 80,
      DESIRED_TASK_COUNT: 1,
    },
  },
  /**
   * CAMUNDA CONFIG
   */
  CAMUNDA: {},

  /**
   * RDS CONFIG
   */
  RDS: {
    // Define the name given to a database that Amazon RDS creates when it creates the DB instance
    DB_NAME: "strapi",
    // The master user of the DB
    DB_USER: "postgres",
    // the master password will be generated and stored in AWS Secrets Manager.
    DB_SECRET_NAME: "POSTGRESQL_SECRET",
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
  },
};
Object.freeze(CONFIG);
export { CONFIG };
