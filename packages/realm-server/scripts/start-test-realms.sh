#! /bin/sh

NODE_ENV=test NODE_NO_WARNINGS=1 REALM_SECRET_SEED="shhh! it's a secret" ts-node \
  --transpileOnly main \
  --port=4202 \
  \
  --path='./tests/cards' \
  --matrixURL='http://localhost:8008' \
  --username='node-test_realm' \
  --password='password' \
  --fromUrl='/node-test/' \
  --toUrl='/node-test/' \
  \
  --path='../host/tests/cards' \
  --matrixURL='http://localhost:8008' \
  --username='test_realm' \
  --password='password' \
  --fromUrl='/test/' \
  --toUrl='/test/' \
  --fromUrl='https://cardstack.com/base/' \
  --toUrl='http://localhost:4201/base/' \
  \
  --useTestingDomain
