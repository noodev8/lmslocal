import React from 'react';

type MDXComponents = Record<string, React.ComponentType<unknown>>;

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}