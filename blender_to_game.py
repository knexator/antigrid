import bpy
import json
import bmesh

def get_other_face_index(edge, face):
    if len(edge.link_faces) == 1:
        return -1
    if face == edge.link_faces[0]:
        return edge.link_faces[1].index
    return edge.link_faces[0].index

def get_connected_vert_indices(vert):
    return [edge.other_vert(vert).index for edge in vert.link_edges]

def write_some_data(context, filepath, use_some_setting):
    bm = bmesh.from_edit_mesh(context.active_object.data)
    result_faces = []
    
    result_vertices = [{
        "index": v.index,
        "border": v.is_boundary,
        "connected": get_connected_vert_indices(v),
        "px": v.co.x * 100,
        "py": v.co.y * -100,
    } for v in bm.verts]
    
    result_faces = []
    for f in bm.faces:
        v_ids = [l.vert.index for l in f.loops]
        f_ids = [get_other_face_index(l.edge, f) for l in f.loops]
#        v_ids = v_ids[3:] + v_ids[:3]
        
        result_faces.append({
            "index": f.index,
            "value": f.material_index,
            "v0": v_ids[0],
            "v1": v_ids[1],
            "v2": v_ids[2],
            "v3": v_ids[3],
            "c0": f_ids[0],
            "c1": f_ids[1],
            "c2": f_ids[2],
            "c3": f_ids[3],
        })
        
    
    #
    # 0 - 3 - 3
    # |       |
    # 0       2
    # |       |
    # 1 - 1 - 2
    #
    
    
#    {
#      border: false,
#      connected: [6, 13, 22, 15],
#      px: 88,
#      index: 14,
#      py: 308
#    },
#    
#    {
#      c3: -1,
#      index: 0,
#      v0: 0,
#      v1: 1,
#      v2: 9,
#      v3: 8,
#      c0: -1,
#      value: 1,
#      c1: 1,
#      c2: 2
#    },
    
    print("running write_some_data...")
    f = open(filepath, 'w', encoding='utf-8')
    f.write("export let LEVEL_DATA = " + json.dumps({
        "vertices": result_vertices,
        "faces": result_faces,
    }))
    f.close()

    return {'FINISHED'}


# ExportHelper is a helper class, defines filename and
# invoke() function which calls the file selector.
from bpy_extras.io_utils import ExportHelper
from bpy.props import StringProperty, BoolProperty, EnumProperty
from bpy.types import Operator


class ExportSomeData(Operator, ExportHelper):
    """This appears in the tooltip of the operator and in the generated docs"""
    bl_idname = "export_test.some_data"  # important since its how bpy.ops.import_test.some_data is constructed
    bl_label = "Export Some Data"

    # ExportHelper mixin class uses this
    filename_ext = ".js"

    filter_glob: StringProperty(
        default="*.js",
        options={'HIDDEN'},
        maxlen=255,  # Max internal buffer length, longer would be clamped.
    )

    # List of operator properties, the attributes will be assigned
    # to the class instance from the operator settings before calling.
    use_setting: BoolProperty(
        name="Example Boolean",
        description="Example Tooltip",
        default=True,
    )

    type: EnumProperty(
        name="Example Enum",
        description="Choose between two items",
        items=(
            ('OPT_A', "First Option", "Description one"),
            ('OPT_B', "Second Option", "Description two"),
        ),
        default='OPT_A',
    )

    def execute(self, context):
        return write_some_data(context, self.filepath, self.use_setting)


# Only needed if you want to add into a dynamic menu
def menu_func_export(self, context):
    self.layout.operator(ExportSomeData.bl_idname, text="Text Export Operator")

# Register and add to the "file selector" menu (required to use F3 search "Text Export Operator" for quick access)
def register():
    bpy.utils.register_class(ExportSomeData)
    bpy.types.TOPBAR_MT_file_export.append(menu_func_export)


def unregister():
    bpy.utils.unregister_class(ExportSomeData)
    bpy.types.TOPBAR_MT_file_export.remove(menu_func_export)


if __name__ == "__main__":
    register()

    # test call
    bpy.ops.export_test.some_data('INVOKE_DEFAULT')
