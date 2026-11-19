<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Python

- Python and Python packages come from **MacPorts**. The Python is **3.14** (`python314`); if it is missing, install it with `sudo port install python314`.
- MacPorts is the active Python: `port select` points `python` and `python3` at `python314` (and `pip` / `pip3` at `pip314` once `py314-pip` is installed). If it does not, run `sudo port select --set python python314` and `sudo port select --set python3 python314`. `/opt/local/bin` comes before any other Python on `PATH`.
- A Python tool (slither and the like) is installed into this **global** MacPorts Python: as a MacPorts port (`sudo port install py314-<name>`) when one exists, otherwise with the MacPorts `pip install <name>`. No venv, no `pip install --user`, no other Python (python.org in `/usr/local`, Apple `/usr/bin/python3`, `~/Library/Python`).
- There is no question where a Python package goes: always the global MacPorts Python. A command that needs `sudo` is given to the user to run, verbatim.
