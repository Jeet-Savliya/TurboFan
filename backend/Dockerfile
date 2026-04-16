FROM node:18

# install python 3.10
RUN apt-get update && apt-get install -y python3 python3-pip

WORKDIR /app

# copy files
COPY . .

# install node deps
RUN npm install

# install python deps
RUN pip3 install -r requirements.txt

# expose port
EXPOSE 10000

# start server
CMD ["node", "server.js"]
