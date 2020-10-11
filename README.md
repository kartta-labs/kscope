# kscope

kscope is client-side only browser application to render a 3D view of maps.
The input is the map features in an area in GeoJSON format. kscope is part
of the Kartta Labs suite of applications.

To run a local copy of kscope

1. Copy `config.example.js` to `config.js`
2. Set the backend endpoint in `config.js` file.
3. Run a webserver in the `kscope` directory with your favorite http server application (e.g., `python -m SimpleHTTPServer`)
4. You can visit the application at http://localhost:8000 or any other port that you chose at step 3.
