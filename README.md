# CS598-OM
CS 598 Online Moderation Project

## Running the backend

This project uses:

- Python 3.11.14

To reproduce the environment:

```bash
conda env create -f environment.yml
```

To install FastAPI:
```bash
pip install "fastapi[standard]"
```

To run the backend server:

```bash
fastapi dev backend/main.py
```