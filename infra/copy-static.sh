#!/bin/sh
set -eu
rm -rf /out/*
cp -r /dist/. /out/
echo "Static files copied to /out"
