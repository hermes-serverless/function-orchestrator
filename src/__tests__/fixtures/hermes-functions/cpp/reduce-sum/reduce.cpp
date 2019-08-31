#include <stdio.h>

int main() {
  int n;

  scanf("%d", &n);
  
  int x;
  long long sum = 0;
  for (int i = 0; i < n; i++) {
    scanf("%d", &x);
    sum += x;
  }

  printf("%lld\n", sum);
  
  return 0;
}