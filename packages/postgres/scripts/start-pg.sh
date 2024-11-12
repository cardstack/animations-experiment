#! /bin/sh
if [ -z "$(docker ps -f name=boxel-pg --all --format '{{.Names}}')" ]; then
  # running postgres on port 5435 so it doesn't collide with native postgres
  # that may be running on your system
  docker run --name boxel-pg -e POSTGRES_HOST_AUTH_METHOD=trust -p 5435:5432 -d postgres:16.3 >/dev/null
else
  docker start boxel-pg >/dev/null
fi
