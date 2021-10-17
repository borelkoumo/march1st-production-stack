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
      WORKING_DIR: "/srv/app",
      HOST_PORT: 1337,
      CONTAINER_PORT: 1337,
      ECR: {
        IMAGE: "strapi-with-efs",
        TAG: "v4",
      },
      DOCKER: {
        IMAGE: "strapi/strapi",
        TAG: "3.6.8-node14",
      },
    },
    SERVICE: {
      NAME: "strapi-svc",
      ALB_NAME: "strapi-alb",
      DESIRED_TASK_COUNT: 1,
      AUTO_SCALING_MIN: 1,
      AUTO_SCALING_MAX: 5,
      ALB_LISTENER_PORT: 80,
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
  EC2: {
    // This references an existing key pair in the account
    KEY_PAIR_NAME: `strapi-web-server-key-pair`,
  },
};
Object.freeze(CONFIG);
export { CONFIG };
