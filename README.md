# PDF Rotator, Page Remover, and Previewer

A client-side PDF editor: preview a PDF in the browser, rotate or delete pages, merge in another file, draw shape annotations, and save the result. Rendering uses pdf.js and editing uses pdf-lib — files never leave your machine.

## Features

- Drag-and-drop upload with page-by-page preview, zoom, and pagination
- Rotate individual pages clockwise or counter-clockwise
- Mark pages for deletion (with protection against removing the last page)
- Merge a second PDF into the current document
- Draw rectangle annotations with a color palette
- Save As with optional image-based compression to shrink file size

## Run locally

Prerequisite: Node.js

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
