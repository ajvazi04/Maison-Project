FROM node:22-alpine AS frontend
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS publish
WORKDIR /src
COPY Maison.Api/Maison.Api.csproj Maison.Api/
RUN dotnet restore Maison.Api/Maison.Api.csproj
COPY Maison.Api/ Maison.Api/
RUN dotnet publish Maison.Api/Maison.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=publish --chown=$APP_UID:$APP_UID /app/publish .
COPY --from=frontend --chown=$APP_UID:$APP_UID /src/dist ./wwwroot
RUN mkdir -p /data/keys && chown -R $APP_UID:$APP_UID /data
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Maison.Api.dll"]
