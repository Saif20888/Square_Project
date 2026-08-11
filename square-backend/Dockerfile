# Multi-stage build: compile with Maven + JDK, run on a slim JRE.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system square && useradd --system --gid square --no-create-home square
COPY --from=build /app/target/*.jar app.jar
RUN chown square:square app.jar
USER square
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
