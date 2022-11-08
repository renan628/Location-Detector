# User geolocation app
This app uses the free [IPStack](https://ipstack.com/) API to get a user geolocation through their IP address.

## How it works
1. The app subscribe to a input kafka topic
2. From this topic the application receives user ID and IP, so this IP is submitted to [IPStack](https://ipstack.com/) which returns the geolocation data
3. The primary user information is added to this new data and the full user information is then sended to a output kafka topic

Each time a new IP comes from "input" topic, its information is also kept in a [Redis](https://redis.io/) cache, which stores the data for a given time period. If a cached IP arrives from "input", the cache is retrieved and no [IPStack](https://ipstack.com/) request will be made, neither a new message is sent to "output". As soon as the cache expires the regular behavior is re-established.

## Running
The app runs with [Docker](https://docs.docker.com/). All the necessary dependencies as well the application can be runned through [docker-compose](https://docs.docker.com/compose/) with the following command:
```
docker-compose up
```

## Running in development and testing
To run only the app dependencies use the command:
```
docker-compose -f docker-compose-infra.yaml up
```
It"s possible run the app in development mode with:
```
npm run start:dev
```
And it"s possible to execute the [Jest](https://jestjs.io/) tests with
```
npm test
```
Both the commands can be runned directly in the host machine, where [Node](https://nodejs.org/en/) version 16 or higher is necessary.

Optionally a docker container can be used as well. For this, enter the command:
```
docker run --rm -it --volume $(pwd):/usr/app --workdir /usr/app --network="host" node:18.1-alpine sh
```
This command will run a [Node](https://nodejs.org/en/) image in the same version of production using the host machine network interface. Inside the container terminal, just use the presented development and test commands.

### Manual test
If you want to do a manual test, once kafka is initialized, you can send a message to the input topic using the kafka docker image:
1. Run  ``docker run -it --network="host" confluentinc/cp-kafka:latest bash`` to get a terminal in container
2. Enter ``kafka-console-producer --broker-list localhost:9094 --topic input`` to produce at input topic
3. Enter a message like ``{"clientID":"1","timestamp":0,"ip":"179.179.133.165"}``

## Environment and execution
Some app configurations (like [IPStack](https://ipstack.com/) API key), are made by environment variables using **.env** files. The production execution uses the **.env** file, while development uses **.env.development** file and test uses **.env.test** file. Once development and test executions are generally made outside the docker-compose network, it"s necessary to use the external interfaces of the services. Only the **.env.sample** file must be renamed to **.env**, and only **API_KEY** must be necessarily changed for a real key considering the given **env.sample** to run the app.

## Kafka Control Center
To inspect the kafka cluster and the topics, a [Kafka Control Center](https://docs.confluent.io/platform/current/control-center/index.html) instance is provided in the [docker-compose](https://docs.docker.com/compose/) files. To access it, just go to **localhost:9021**