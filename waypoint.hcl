project = "cardstack"

app "realm-base" {
  path = "./packages/realm-server"

  build {
    use "docker" {
      # This just means the root of the repository, it’s not relative to the above
      context = "./"

      build_args = {
        realm_server_script = "start:base:staging"
      }
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "realm-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "realm-base-staging"
      count               = 2
      subnets             = ["subnet-099d721ad678d073a", "subnet-0d1196fa815f3d057"]
      task_role_name      = "realm-base-ecs-task"
      execution_role_name = "realm-base-ecs-task-execution"
      security_group_ids  = ["sg-05f830d022a2cd913"] # FIXME this should be a Terraform output maybe?

      alb {
        subnets     = ["subnet-099d721ad678d073a", "subnet-0d1196fa815f3d057"]
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/11ae7191-23fc-4101-a8ad-aab2e4cb520e"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "realm-base"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "realm-base"]
    }
  }

  url {
    auto_hostname = false
  }
}

app "realm-demo" {
  path = "./packages/realm-server"

  build {
    use "docker" {
      context = "./"

      build_args = {
        realm_server_script = "start:demo:staging"
      }
    }

    registry {
      use "aws-ecr" {
        region     = "us-east-1"
        repository = "realm-staging"
        tag        = "latest"
      }
    }
  }

  deploy {
    use "aws-ecs" {
      region              = "us-east-1"
      memory              = "512"
      cluster             = "realm-demo-staging"
      count               = 2
      subnets             = ["subnet-099d721ad678d073a", "subnet-0d1196fa815f3d057"]
      task_role_name      = "realm-demo-ecs-task"
      execution_role_name = "realm-demo-ecs-task-execution"
      security_group_ids  = ["sg-05f830d022a2cd913"] # FIXME this should be a Terraform output maybe?

      alb {
        subnets     = ["subnet-099d721ad678d073a", "subnet-0d1196fa815f3d057"]
        certificate = "arn:aws:acm:us-east-1:680542703984:certificate/4eccc35e-049b-4bbd-b007-575ffa3cb752"
      }
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/waypoint-ecs-add-tags.mjs", "realm-demo"]
    }

    hook {
      when    = "after"
      command = ["node", "./scripts/wait-service-stable.mjs", "realm-demo"]
    }
  }

  url {
    auto_hostname = false
  }
}
