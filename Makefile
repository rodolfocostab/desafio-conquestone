# Atalhos opcionais (Linux/macOS/Git Bash no Windows)
.PHONY: up down logs ps

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps
