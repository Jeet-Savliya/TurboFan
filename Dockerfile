# Root Dockerfile for Cloud Deployments (Render / Hugging Face Spaces)
FROM node:18

# Install python and pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Create overall app directory
WORKDIR /app

# Copy the entire repository (including PROJECT-1 models and datasets)
# This solves the issue of the backend Docker container missing the local parent directory
COPY . .

# Move into backend directory for Node setup
WORKDIR /app/backend

# Install node dependencies
RUN npm install

# Install python dependencies
RUN pip3 install -r requirements.txt

# The backend will need to know where the models are now
ENV PROJECT_ROOT=/app/PROJECT-1

# Important: Start Express server on Render's designated port (it defaults to 10000 but we can expose 5000)
# We will use PORT env var to let Render override it easily
ENV PORT=10000
EXPOSE 10000

# Start Express server
CMD ["node", "server.js"]
