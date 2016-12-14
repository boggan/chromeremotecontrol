#!/bin/bash

COMMENT_STR=""
for word in $@
do
	COMMENT_STR="$COMMENT_STR $word"
done

git add --all
git commit -m "$COMMENT_STR"
git push origin master:latest
