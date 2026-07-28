# Use the official lightweight Python image
FROM python:3.11-slim

# Set environment variables for optimal Python execution
# PYTHONDONTWRITEBYTECODE: Prevents Python from writing .pyc files to disk
# PYTHONUNBUFFERED: Ensures standard output and error streams are sent straight to terminal
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set the working directory
WORKDIR /app


# Copy only the requirements file first to leverage Docker cache
COPY requirements.txt .

# Install dependencies without caching to keep the image size small
RUN pip install -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port that Uvicorn will run on
EXPOSE 8000

# Start the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
