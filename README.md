# Entity Manager


## Deployment

### Docker Deployment

To deploy this application using Docker, follow these steps:

1.  **Build the Docker image:**
    ```bash
    docker build -t entitymanager .
    ```

2.  **Run the Docker container:**
    ```bash
    docker run -p 3000:3000 -v ./data:/usr/src/app/data entitymanager
    ```

    Alternatively, you can use Docker Compose:
    ```bash
    docker-compose up
    ```
3. **Updating the container**
   ```
    docker compose up --build --force-recreate
   ```

### Manual Deployment

To deploy this application manually, ensure you have Node.js version 18 installed.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the application:**
    ```bash
    npm start
    ```
    The application will be available at http://localhost:3000.
