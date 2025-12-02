#!/usr/bin/python3

dist_dir = './dist/'
site_dir = '../theia-gay-web/source/neo/'

import shutil
shutil.copytree(dist_dir, site_dir, dirs_exist_ok=True)
