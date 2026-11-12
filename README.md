# Student Management System (Microservices + Docker + Kubernetes)

REST API to store, update and retrieve student information, built with Node.js / Express / MongoDB (Mongoose),
containerized with Docker and deployed on Minikube.

**Database schema (collection `LabExam`, database `LabExam`)**
`Student_id`, `Student_name`, `student_mobile`, `student_email`, `student_password` (stored as a bcrypt hash)

## Architecture

```
 Postman ──► NodePort 30080
                │
   ┌────────────▼─────────────── POD 1 ───────────────┐        ┌──── POD 2 ────┐
   │  api-gateway :3000  ──localhost:3001──►           │        │ update-service │
   │                     registration-service :3001    │        │     :3002      │
   └───────────────────────┬───────────────────────────┘        └───────┬────────┘
                           │      gateway ──► Service "update-service" ─┘
                           └───────────────┬───────────────────────────┘
                                      MongoDB (Service "mongodb":27017)
```

| Microservice | Port | Role |
|---|---|---|
| `api-gateway` | 3000 | Single entry point, forwards requests |
| `registration-service` | 3001 | Register students (common for all) |
| `update-service` | 3002 | **2nd microservice: update student mobile number or password** |

## API (all calls go through the gateway)

| Method | URL | Body | Handled by |
|---|---|---|---|
| POST | `/api/register` | `Student_name, student_mobile, student_email, student_password` | registration |
| GET | `/api/students` , `/api/students/:id` | – | registration (for verifying) |
| PUT | `/api/students/:id/mobile` | `student_mobile` | update |
| PUT | `/api/students/:id/password` | `old_password, new_password` | update |
| PATCH | `/api/students/:id` | `student_mobile` and/or `old_password + new_password` | update |

`Student_id` is generated automatically (1, 2, 3, ...). Passwords are never returned by the API.

## Run on Minikube

```bash
# 1. Start minikube and point Docker at minikube's daemon
minikube start
eval $(minikube docker-env)          # Windows PowerShell: & minikube -p minikube docker-env --shell powershell | Invoke-Expression

# 2. Build the 3 images (Task 2)
docker build -t api-gateway:1.0           ./api-gateway
docker build -t registration-service:1.0  ./registration-service
docker build -t update-service:1.0        ./update-service

# 3. Deploy (Tasks 3 and 4)
kubectl apply -f k8s/01-mongodb.yaml
kubectl apply -f k8s/02-pod1-gateway-registration.yaml
kubectl apply -f k8s/03-pod2-update.yaml
kubectl apply -f k8s/04-services.yaml

# 4. Check
kubectl get pods
kubectl get svc

# 5. Get the URL for Postman (use this as base_url)
minikube service api-gateway-service --url
```

With the Docker driver on Windows/macOS, keep that `minikube service ... --url` terminal open and use the printed
`http://127.0.0.1:<port>` as `base_url`. With other drivers use `http://$(minikube ip):30080`.

Quick test:
```bash
curl -X POST <base_url>/api/register -H "Content-Type: application/json" \
  -d '{"Student_name":"Yiyao","student_mobile":"012345678","student_email":"yiyao@example.com","student_password":"secret123"}'
```

Import `postman/Student-Management-System.postman_collection.json` into Postman and set the `base_url` variable.

## Database screenshot (Task 5)

```bash
kubectl exec -it deploy/mongodb -- mongosh LabExam --eval "db.LabExam.find().pretty()"
```
(If `mongosh` is missing in the image, use `mongo` instead of `mongosh`.)

## Screenshot checklist

| Task | What to capture |
|---|---|
| 1 | `api-gateway/server.js`, `registration-service/server.js`, `update-service/server.js` (3 screenshots) |
| 2 | The 3 `Dockerfile`s (3 screenshots) |
| 3 | `k8s/02-pod1-gateway-registration.yaml` and `k8s/03-pod2-update.yaml` (+ `kubectl get pods` showing Running) |
| 4 | `k8s/04-services.yaml` (+ `kubectl get svc`) |
| 5 | Postman: POST `/api/register` (201) and the MongoDB `db.LabExam.find()` output |
| 6 | Postman: PUT `/api/students/1/mobile` and PUT `/api/students/1/password` |
| 7 | GitHub repository link |

## Push to GitHub (Task 7)

```bash
git init
git add .
git commit -m "Student Management System: microservices, Docker, Kubernetes"
git branch -M main
git remote add origin https://github.com/<your-username>/student-management-system.git
git push -u origin main
```

## Environment variables (.env)

Each service folder has its own `.env` (copy it from `.env.example`):

- `api-gateway/.env` -> `PORT`, `REGISTRATION_URL`, `UPDATE_URL`
- `registration-service/.env` -> `PORT`, `MONGO_URI`
- `update-service/.env` -> `PORT`, `MONGO_URI`

They are used when you run a service locally (`npm install`, then `npm start`). `.env` is git-ignored and
docker-ignored. In Kubernetes the values come from the `env:` section of the pod YAML files, which take priority.

## Troubleshooting

- `ErrImageNeverPull`: you built the images outside minikube's Docker. Re-run `eval $(minikube docker-env)` and rebuild.
- Pod 1 shows `1/2` ready: wait a few seconds, the services retry until MongoDB is up (`kubectl logs deploy/pod1-gateway-registration -c registration-service`).
- `502 Bad gateway`: the downstream pod is not ready yet, check `kubectl get pods`.
