# Docker Quick Reference

## Images

```bash
docker images                          # list local images
docker pull nginx:alpine               # pull image
docker build -t my-app:latest .        # build from Dockerfile
docker build --no-cache -t my-app .    # build without cache
docker rmi my-app:latest               # remove image
docker image prune                     # remove dangling images
docker image prune -a                  # remove all unused images
```

## Containers

```bash
# Run
docker run -d -p 8080:80 nginx         # detached with port mapping
docker run -it ubuntu bash             # interactive shell
docker run --rm alpine echo hello      # remove on exit
docker run -e ENV=prod my-app          # with env var
docker run -v $(pwd):/app my-app       # bind mount

# Manage
docker ps                              # running containers
docker ps -a                           # all containers
docker stop <id>                       # graceful stop
docker rm <id>                         # remove stopped container
docker logs -f <id>                    # follow logs
docker exec -it <id> bash              # shell into container
docker inspect <id>                    # detailed info
```

## Docker Compose

```bash
docker compose up -d                   # start in background
docker compose up --build              # rebuild and start
docker compose down                    # stop and remove containers
docker compose down -v                 # also remove volumes
docker compose logs -f                 # follow all logs
docker compose logs -f service         # follow specific service
docker compose exec service bash       # shell into service
docker compose ps                      # status of services
docker compose restart service         # restart specific service
```

## Cleanup

```bash
docker system prune                    # remove unused resources
docker system prune -a --volumes       # aggressive cleanup
docker volume prune                    # remove unused volumes
docker network prune                   # remove unused networks
```

## Common Dockerfile Patterns

```dockerfile
# Multi-stage build (Node.js)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Useful Tips

```bash
# Copy file from container
docker cp <id>:/app/log.txt ./log.txt

# Save image to tar
docker save my-app | gzip > my-app.tar.gz

# Load image from tar
docker load < my-app.tar.gz

# Show resource usage
docker stats

# Get container IP
docker inspect -f '{{.NetworkSettings.IPAddress}}' <id>
```
