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
      ECR_IMAGE: "strapi-with-efs",
      ECR_IMAGETAG: "v4",
      MOUNT_POINT: "/src/app",
      HOST_PORT: 1337,
      CONTAINER_PORT: 1337,
    },
    SERVICE: {
      NAME: "strapi-svc",
      TARGET_GROUP_NAME: "strapi-tg",
      ALB_PATH: "/strapi/*",
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
};
Object.freeze(CONFIG);
export { CONFIG };
