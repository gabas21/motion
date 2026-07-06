# Stage 1: Build & Development environment
FROM golang:1.25-alpine AS development

# Install build dependencies & Air for hot reloading
RUN apk add --no-cache git gcc musl-dev && \
    go install github.com/air-verse/air@latest

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application code
COPY . .

# Command for development hot-reloading (can be overridden by compose)
CMD ["air", "-c", ".air.toml"]

# Stage 2: Build the production binary
FROM development AS builder
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Stage 3: Final lightweight runner
FROM alpine:3.18

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary from build stage
COPY --from=builder /app/main .

# Expose Go Echo server port
EXPOSE 8080

# Command to run
CMD ["./main"]
