npm i

npm run dev

Backend (optional):

1. Copy `server/.env.example` to `server/.env` and fill in values.
2. Start the backend with `npm run server`.
3. (Optional but recommended) Train and store the external `.pkl` Random Forest model:
   - `POST http://localhost:4000/predictions/train-model`
   - This generates:
     - `server/ml/models/random_forest_model.pkl`
     - `server/ml/models/random_forest_model.meta.json`

Flask Complaints Backend (MongoDB):

1. Install Python dependencies:
   - `pip install -r server_flask/requirements.txt`
2. Copy `server_flask/.env.example` to `server_flask/.env` and update MongoDB values if needed.
3. Start the Flask server:
   - `npm run server:flask`
4. API endpoint:
   - `GET http://localhost:5001/api/complaints/user/<user_id>`

Frontend (optional):

- Set `VITE_BACKEND_URL` to the backend base URL (e.g., `http://localhost:4000`) to route predictions through the custom API.
- Set `VITE_COMPLAINTS_API_URL` to the Flask complaints API base (e.g., `http://localhost:5001/api`) for the Track Complaints tab.

Patrol suggestions:

- Each suggestion includes a Driving/Walking toggle for Google Maps directions.
- "Open in Google Maps" uses place names and opens in the same tab.

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
