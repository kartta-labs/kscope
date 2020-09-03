# Renderer

Renderer is client-side only browser application to render a 3D view of maps.
The input is the map features in an area in GeoJSON format. Renderer is part
of the Kartta Labs suite of applications.

To run a local copy of Renderer

1. Copy `settings.example.js` to `settings.js`
2. Set the backend endpoints and make your desired changes in `settings.js` file.
3. Run a webserver in the `renderer` directory with your favorite http server application (e.g., `python -m SimpleHTTPServer`)
4. You can visit the application at http://localhost:8000 or any other port that you chose at step 3.
