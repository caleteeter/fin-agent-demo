# Ingestion service for LanceDB - Finance Demo

This is the ingestion service that will parse PDFs, create embeddings and import them to the LanceDB instance.

## Prerequisites

- [NodeJS](https://nodejs.org) - >= v10.0

## Configuration

Create a __.env__ file in the projet folder and add the following:

```
OPENAI_API_KEY=<your api key>
```

`NOTE: this OpenAI service will need access to gpt-4o-mini and text-embedding-3-small models`

## Build

```
npm run build
```

## Run

```
npm start
```