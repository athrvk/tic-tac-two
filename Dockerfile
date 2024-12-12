# Dockerfile
# Build frontend
FROM node:16-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# Build backend
FROM maven:3.8-openjdk-17 AS backend-build
WORKDIR /app/backend
# Copy frontend build to backend resources first
COPY --from=frontend-build /app/frontend/build ./src/main/resources/static
COPY backend/pom.xml .
COPY backend/src ./src
RUN mvn clean package 

# Final image
FROM openjdk:17-slim
WORKDIR /app
COPY --from=backend-build /app/backend/target/*.jar ./app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]