// Quadric edge-collapse simplifier with per-corner UVs and UV-seam constraints.
// Based on the Fast-Quadric-Mesh-Simplification approach (Garland-Heckbert QEM).
// Input (binary): int nv, int nt, float pos[nv*3], int tri[nt*3], float uv[nt*6]
// Output (binary): same layout.
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <cstring>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <cstdint>
using namespace std;

struct vec3 { double x, y, z;
  vec3() : x(0), y(0), z(0) {}
  vec3(double a, double b, double c) : x(a), y(b), z(c) {}
  vec3 operator+(const vec3& o) const { return vec3(x + o.x, y + o.y, z + o.z); }
  vec3 operator-(const vec3& o) const { return vec3(x - o.x, y - o.y, z - o.z); }
  vec3 operator*(double s) const { return vec3(x * s, y * s, z * s); }
  double dot(const vec3& o) const { return x * o.x + y * o.y + z * o.z; }
  vec3 cross(const vec3& o) const { return vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x); }
  double len() const { return sqrt(x * x + y * y + z * z); }
  vec3 norm() const { double l = len(); return l > 0 ? (*this) * (1.0 / l) : *this; }
};
struct SM { double m[10];
  SM(double c = 0) { for (int i = 0; i < 10; i++) m[i] = c; }
  SM(double a, double b, double c, double d) {
    m[0] = a * a; m[1] = a * b; m[2] = a * c; m[3] = a * d;
    m[4] = b * b; m[5] = b * c; m[6] = b * d;
    m[7] = c * c; m[8] = c * d; m[9] = d * d; }
  double operator[](int c) const { return m[c]; }
  double det(int a11, int a12, int a13, int a21, int a22, int a23, int a31, int a32, int a33) const {
    return m[a11] * m[a22] * m[a33] + m[a13] * m[a21] * m[a32] + m[a12] * m[a23] * m[a31]
         - m[a13] * m[a22] * m[a31] - m[a11] * m[a23] * m[a32] - m[a12] * m[a21] * m[a33]; }
  SM operator+(const SM& n) const { SM r; for (int i = 0; i < 10; i++) r.m[i] = m[i] + n.m[i]; return r; }
  SM& operator+=(const SM& n) { for (int i = 0; i < 10; i++) m[i] += n.m[i]; return *this; }
  SM operator*(double s) const { SM r; for (int i = 0; i < 10; i++) r.m[i] = m[i] * s; return r; }
};
struct Tri { int v[3]; double err[4]; int deleted, dirty; vec3 n; double uv[3][2]; };
struct Vert { vec3 p; int tstart, tcount; SM q; int border; };
struct Ref { int tid, tvertex; };
vector<Tri> T; vector<Vert> V; vector<Ref> R;

double verr(const SM& q, double x, double y, double z) {
  return q[0]*x*x + 2*q[1]*x*y + 2*q[2]*x*z + 2*q[3]*x + q[4]*y*y + 2*q[5]*y*z + 2*q[6]*y + q[7]*z*z + 2*q[8]*z + q[9];
}
double cerr(int a, int b, vec3& pr) {
  SM q = V[a].q + V[b].q; bool border = V[a].border & V[b].border; double e = 0;
  double det = q.det(0, 1, 2, 1, 4, 5, 2, 5, 7);
  if (det != 0 && !border) {
    pr.x = -1 / det * q.det(1, 2, 3, 4, 5, 6, 5, 7, 8);
    pr.y = 1 / det * q.det(0, 2, 3, 1, 5, 6, 2, 7, 8);
    pr.z = -1 / det * q.det(0, 1, 3, 1, 4, 6, 2, 5, 8);
    // keep solution near the edge to avoid spikes
    vec3 mid = (V[a].p + V[b].p) * 0.5; double el = (V[a].p - V[b].p).len();
    if ((pr - mid).len() > el * 2.0 + 1e-9) { pr = mid; }
    e = verr(q, pr.x, pr.y, pr.z);
  } else {
    vec3 p1 = V[a].p, p2 = V[b].p, p3 = (p1 + p2) * 0.5;
    double e1 = verr(q, p1.x, p1.y, p1.z), e2 = verr(q, p2.x, p2.y, p2.z), e3 = verr(q, p3.x, p3.y, p3.z);
    e = min(e1, min(e2, e3));
    if (e1 == e) pr = p1; if (e2 == e) pr = p2; if (e3 == e) pr = p3;
  }
  return e;
}
bool flipped(vec3 p, int i1, Vert& v0, vector<int>& del) {
  for (int k = 0; k < v0.tcount; k++) {
    Tri& t = T[R[v0.tstart + k].tid]; if (t.deleted) continue;
    int s = R[v0.tstart + k].tvertex; int id1 = t.v[(s + 1) % 3], id2 = t.v[(s + 2) % 3];
    if (id1 == i1 || id2 == i1) { del[k] = 1; continue; }
    vec3 d1 = (V[id1].p - p).norm(), d2 = (V[id2].p - p).norm();
    if (fabs(d1.dot(d2)) > 0.999) return true;
    vec3 n = d1.cross(d2).norm(); del[k] = 0;
    if (n.dot(t.n) < 0.2) return true;
  }
  return false;
}
void bary(const vec3& p, const vec3& a, const vec3& b, const vec3& c, double& u, double& v, double& w) {
  vec3 v0 = b - a, v1 = c - a, v2 = p - a;
  double d00 = v0.dot(v0), d01 = v0.dot(v1), d11 = v1.dot(v1), d20 = v2.dot(v0), d21 = v2.dot(v1);
  double den = d00 * d11 - d01 * d01;
  if (fabs(den) < 1e-30) { u = 1; v = 0; w = 0; return; }
  v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den; u = 1 - v - w;
}
void update_uvs(Vert& v, const vec3& p, vector<int>& del) {
  for (int k = 0; k < v.tcount; k++) {
    Ref& r = R[v.tstart + k]; Tri& t = T[r.tid]; if (t.deleted || del[k]) continue;
    double a, b, c; bary(p, V[t.v[0]].p, V[t.v[1]].p, V[t.v[2]].p, a, b, c);
    // clamp to triangle to stay inside the UV island
    a = max(0.0, a); b = max(0.0, b); c = max(0.0, c); double s = a + b + c; if (s <= 0) { a = 1; s = 1; }
    a /= s; b /= s; c /= s;
    double nu = a * t.uv[0][0] + b * t.uv[1][0] + c * t.uv[2][0];
    double nv = a * t.uv[0][1] + b * t.uv[1][1] + c * t.uv[2][1];
    t.uv[r.tvertex][0] = nu; t.uv[r.tvertex][1] = nv;
  }
}
void update_tris(int i0, Vert& v, vector<int>& del, int& dt) {
  vec3 p;
  for (int k = 0; k < v.tcount; k++) {
    Ref& r = R[v.tstart + k]; Tri& t = T[r.tid]; if (t.deleted) continue;
    if (del[k]) { t.deleted = 1; dt++; continue; }
    t.v[r.tvertex] = i0; t.dirty = 1;
    t.err[0] = cerr(t.v[0], t.v[1], p); t.err[1] = cerr(t.v[1], t.v[2], p); t.err[2] = cerr(t.v[2], t.v[0], p);
    t.err[3] = min(t.err[0], min(t.err[1], t.err[2]));
    R.push_back(r);
  }
}
double SEAMW = 1.0;
void update_mesh(int it) {
  if (it > 0) { int dst = 0; for (size_t i = 0; i < T.size(); i++) if (!T[i].deleted) T[dst++] = T[i]; T.resize(dst); }
  for (auto& v : V) { v.tstart = 0; v.tcount = 0; }
  for (auto& t : T) for (int j = 0; j < 3; j++) V[t.v[j]].tcount++;
  int ts = 0; for (auto& v : V) { v.tstart = ts; ts += v.tcount; v.tcount = 0; }
  R.resize(T.size() * 3);
  for (size_t i = 0; i < T.size(); i++) for (int j = 0; j < 3; j++) { Vert& v = V[T[i].v[j]]; R[v.tstart + v.tcount].tid = i; R[v.tstart + v.tcount].tvertex = j; v.tcount++; }
  if (it == 0) {
    vector<int> vc, vids;
    for (auto& v : V) v.border = 0;
    for (size_t i = 0; i < V.size(); i++) {
      Vert& v = V[i]; vc.clear(); vids.clear();
      for (int j = 0; j < v.tcount; j++) { Tri& t = T[R[v.tstart + j].tid];
        for (int k = 0; k < 3; k++) { int id = t.v[k], ofs = 0;
          while (ofs < (int)vc.size()) { if (vids[ofs] == id) break; ofs++; }
          if (ofs == (int)vc.size()) { vc.push_back(1); vids.push_back(id); } else vc[ofs]++; } }
      for (size_t j = 0; j < vc.size(); j++) if (vc[j] == 1) V[vids[j]].border = 1;
    }
    for (auto& v : V) v.q = SM(0.0);
    for (auto& t : T) {
      vec3 p[3]; for (int j = 0; j < 3; j++) p[j] = V[t.v[j]].p;
      vec3 n = (p[1] - p[0]).cross(p[2] - p[0]); double area = n.len() * 0.5; n = n.norm(); t.n = n;
      for (int j = 0; j < 3; j++) V[t.v[j]].q += SM(n.x, n.y, n.z, -n.dot(p[0]));
    }
    // UV seam constraints: planes through seam edge, perpendicular to adjacent face
    unordered_map<uint64_t, pair<int, int>> em; em.reserve(T.size() * 2);
    int seams = 0;
    for (size_t ti = 0; ti < T.size(); ti++) for (int j = 0; j < 3; j++) {
      int a = T[ti].v[j], b = T[ti].v[(j + 1) % 3];
      uint64_t key = a < b ? ((uint64_t)a << 32) | b : ((uint64_t)b << 32) | a;
      auto it2 = em.find(key);
      if (it2 == em.end()) { em[key] = make_pair((int)ti, j); continue; }
      Tri& t0 = T[it2->second.first]; int j0 = it2->second.second; Tri& t1 = T[ti];
      // uv of a,b in t0 and t1
      int a0 = j0, b0 = (j0 + 1) % 3; if (t0.v[a0] != a) swap(a0, b0);
      int a1 = j, b1 = (j + 1) % 3;
      double du = fabs(t0.uv[a0][0] - t1.uv[a1][0]) + fabs(t0.uv[a0][1] - t1.uv[a1][1]) + fabs(t0.uv[b0][0] - t1.uv[b1][0]) + fabs(t0.uv[b0][1] - t1.uv[b1][1]);
      if (du > 1e-5) {
        seams++;
        vec3 pa = V[a].p, pb = V[b].p, e = pb - pa; double el = e.len();
        Tri* ts2[2] = { &t0, &t1 };
        for (int s = 0; s < 2; s++) {
          vec3 n = e.cross(ts2[s]->n).norm();
          SM q = SM(n.x, n.y, n.z, -n.dot(pa)) * (SEAMW);
          V[a].q += q; V[b].q += q;
        }
      }
      em.erase(it2);
    }
    fprintf(stderr, "seam edges: %d\n", seams);
    vec3 p;
    for (auto& t : T) { for (int j = 0; j < 3; j++) t.err[j] = cerr(t.v[j], t.v[(j + 1) % 3], p); t.err[3] = min(t.err[0], min(t.err[1], t.err[2])); }
  }
}
void compact() {
  int dst = 0; for (auto& v : V) v.tcount = 0;
  for (size_t i = 0; i < T.size(); i++) if (!T[i].deleted) { T[dst++] = T[i]; for (int j = 0; j < 3; j++) V[T[i].v[j]].tcount = 1; }
  T.resize(dst); dst = 0;
  for (size_t i = 0; i < V.size(); i++) if (V[i].tcount) { V[i].tstart = dst; V[dst].p = V[i].p; dst++; }
  for (auto& t : T) for (int j = 0; j < 3; j++) t.v[j] = V[t.v[j]].tstart;
  V.resize(dst);
}
void simplify(int target, double agg) {
  for (auto& t : T) t.deleted = 0;
  int dt = 0; vector<int> d0, d1; int tc = T.size();
  for (int it = 0; it < 200; it++) {
    if (tc - dt <= target) break;
    if (it % 5 == 0) { update_mesh(it); tc = T.size(); dt = 0; fprintf(stderr, "it %d tris %d\n", it, tc); }
    for (auto& t : T) t.dirty = 0;
    double thr = 0.000000001 * pow(double(it + 3), agg);
    for (size_t i = 0; i < T.size(); i++) {
      Tri& t = T[i]; if (t.err[3] > thr || t.deleted || t.dirty) continue;
      for (int j = 0; j < 3; j++) if (t.err[j] < thr) {
        int i0 = t.v[j], i1 = t.v[(j + 1) % 3];
        Vert& v0 = V[i0]; Vert& v1 = V[i1];
        if (v0.border != v1.border) continue;
        vec3 p; cerr(i0, i1, p);
        d0.resize(v0.tcount); d1.resize(v1.tcount);
        if (flipped(p, i1, v0, d0)) continue;
        if (flipped(p, i0, v1, d1)) continue;
        update_uvs(v0, p, d0); update_uvs(v1, p, d1);
        v0.p = p; v0.q = v1.q + v0.q;
        int tstart = R.size();
        update_tris(i0, v0, d0, dt); update_tris(i0, v1, d1, dt);
        int tcount = R.size() - tstart;
        if (tcount <= v0.tcount) { if (tcount) memcpy(&R[v0.tstart], &R[tstart], tcount * sizeof(Ref)); }
        else v0.tstart = tstart;
        v0.tcount = tcount;
        break;
      }
      if (tc - dt <= target) break;
    }
  }
  compact();
}
int main(int argc, char** argv) {
  if (argc < 4) { fprintf(stderr, "usage: in out target [agg] [seamw]\n"); return 1; }
  FILE* f = fopen(argv[1], "rb"); int nv, nt; fread(&nv, 4, 1, f); fread(&nt, 4, 1, f);
  vector<float> pos(nv * 3); vector<int> tri(nt * 3); vector<float> uv(nt * 6);
  fread(pos.data(), 4, nv * 3, f); fread(tri.data(), 4, nt * 3, f); fread(uv.data(), 4, nt * 6, f); fclose(f);
  double agg = argc > 4 ? atof(argv[4]) : 7; if (argc > 5) SEAMW = atof(argv[5]);
  V.resize(nv); for (int i = 0; i < nv; i++) V[i].p = vec3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  T.resize(nt);
  for (int i = 0; i < nt; i++) { for (int j = 0; j < 3; j++) { T[i].v[j] = tri[i * 3 + j]; T[i].uv[j][0] = uv[i * 6 + j * 2]; T[i].uv[j][1] = uv[i * 6 + j * 2 + 1]; } }
  simplify(atoi(argv[3]), agg);
  FILE* o = fopen(argv[2], "wb"); nv = V.size(); nt = T.size();
  fwrite(&nv, 4, 1, o); fwrite(&nt, 4, 1, o);
  for (auto& v : V) { float p[3] = { (float)v.p.x, (float)v.p.y, (float)v.p.z }; fwrite(p, 4, 3, o); }
  for (auto& t : T) fwrite(t.v, 4, 3, o);
  for (auto& t : T) for (int j = 0; j < 3; j++) { float u[2] = { (float)t.uv[j][0], (float)t.uv[j][1] }; fwrite(u, 4, 2, o); }
  fclose(o); fprintf(stderr, "out verts %d tris %d\n", nv, nt);
}
