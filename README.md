# JIWOONG.dev

Personal developer blog powered by Jekyll and GitHub Pages.

## Writing a post

Create a Markdown file in `_posts` using the format:

```text
YYYY-MM-DD-title.md
```

Example front matter:

```yaml
---
title: "Post title"
description: "Short description"
date: 2026-09-03 20:00:00 +0900
categories: [DevOps]
tags: [Terraform, AWS]
---
```

## Local preview

If Jekyll is installed locally:

```bash
bundle exec jekyll serve
```

The generated `_site` directory is intentionally ignored and should not be committed.
