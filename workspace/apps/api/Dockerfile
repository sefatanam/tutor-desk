# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /build

# Install git (needed by go mod download for some deps)
RUN apk add --no-cache git ca-certificates

# Copy dependency manifests first for layer caching
COPY apps/api/go.mod apps/api/go.sum ./

RUN go mod download

# Copy all source (context is workspace root)
COPY apps/api/ .

# Build a statically-linked binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /api .

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM alpine:3.20

WORKDIR /app

# CA certs for outbound TLS (e.g. Supabase cloud DB)
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from builder
COPY --from=builder /api /app/api

# Uploads directory (mounted as volume in docker-compose)
RUN mkdir -p /app/uploads

# Copy SQL migration files (applied automatically on startup)
COPY apps/api/migrations/ /app/migrations/

EXPOSE 8080

ENTRYPOINT ["/app/api"]
