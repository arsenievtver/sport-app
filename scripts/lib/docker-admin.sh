# Run an admin Python script inside the running API container.
# docker exec bypasses ENTRYPOINT — no uvicorn, no compose --entrypoint quirks.
docker_admin_python() {
  local host_script=$1
  shift
  local name
  name="$(basename "$host_script")"
  local container_script=""

  for candidate in "/scripts/$name" "/app/scripts/$name"; do
    if docker exec sport-app-api test -f "$candidate" >/dev/null 2>&1; then
      container_script=$candidate
      break
    fi
  done

  if [ -z "$container_script" ]; then
    container_script="/tmp/$name"
    docker cp "$host_script" "sport-app-api:$container_script"
  fi

  docker exec -i sport-app-api python "$container_script" "$@"
}
