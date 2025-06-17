# Data service for LanceDB - Finance Demo

This is the data service that exposes a REST based interface that can be used to service requests to the data stored in the LanceDB instance.

## Prerequisites

- [NodeJS](https://nodejs.org) - >= v10.0

## Configuration

Create a __.env__ file in the projet folder and add the following:

```
OPENAI_API_KEY=<your api key>. 
LANCEDB_PATH=<path to the data generated, by default this would be ../data-generator/output>
PORT=<open port for the service, default 3000>
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