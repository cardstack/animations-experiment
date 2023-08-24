project = "cardstack"

app "realm-demo" {
  path = "./packages/realm-server"

  build {
    use "docker" {
      context = "./"

      build_args = {
        realm_server_script = "start:production"
      }
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "realm-demo-production"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = 4096
      cpu                 = 2048 # 2 vCPU's
      cluster             = "realm-demo-production"
      count               = 1
      subnets             = ["subnet-06c640c2bc3b46c6a", "subnet-0ca4ab0b29849bfff"]
      task_role_name      = "realm-demo-ecs-task"
      execution_role_name = "realm-demo-ecs-task-execution"
      security_group_ids  = ["sg-0086ae7f442318880"]

      alb {
        subnets           = ["subnet-06c640c2bc3b46c6a", "subnet-0ca4ab0b29849bfff"]
        load_balancer_arn = "arn:aws:elasticloadbalancing:us-east-1:120317779495:loadbalancer/app/waypoint-ecs-realm-demo/68a96299c568e68e"
        certificate       = "arn:aws:acm:us-east-1:120317779495:certificate/55a995ef-6f98-4834-a953-e1517cc74fb7"
      }

      secrets = {
        # parameter store
        BOXEL_HTTP_BASIC_PW = "arn:aws:ssm:us-east-1:120317779495:parameter/production/boxel/BOXEL_HTTP_BASIC_PW"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-efs.mjs", "realm-demo", "realm-server-storage", "fs-01beb05ea57cb4894", "fsap-0e1180270a9526966", "/persistent"]
    }
  }

  url {
    auto_hostname = false
  }
}
