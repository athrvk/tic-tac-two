# Dockerfile - Optimized for GitHub Actions
# Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files first for better caching
COPY frontend/package*.json ./
RUN npm ci --only=production --no-audit --no-fund

# Copy source files and build
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# Build backend
FROM maven:3.9-eclipse-temurin-17-alpine AS backend-build
WORKDIR /app/backend

# Copy pom.xml first for dependency caching
COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B

# Copy frontend build to backend resources
COPY --from=frontend-build /app/frontend/build ./src/main/resources/static

# Copy source and build
COPY backend/src ./src
RUN mvn clean package -B -DskipTests

# Final runtime image
FROM eclipse-temurin:17-jre

# Create non-root user for security
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser

WORKDIR /app

# Copy jar with specific name for better caching
COPY --from=backend-build --chown=appuser:appgroup /app/backend/target/*.jar ./app.jar

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 10000

# Optimize JVM for containers
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=75.0", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-Dspring.profiles.active=prod", \
    "-jar", \
    "app.jar"]